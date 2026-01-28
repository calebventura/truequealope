"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db, auth } from "@/lib/firebaseClient";
import { useAuth } from "@/hooks/useAuth";
import { Product } from "@/types/product";

import { Order } from "@/types/order";
import { Button } from "@/components/ui/Button";
import { getContactClicksCount, logContactClick } from "@/lib/contact";
import { CATEGORIES, DEFAULT_DASHBOARD_PAGE_SIZE, PAGE_SIZE_OPTIONS } from "@/lib/constants";
import { getAcceptedExchangeTypes } from "@/lib/productFilters";
import { AlertModal } from "@/components/ui/AlertModal";
import { ConfirmModal } from "@/components/ui/ConfirmModal";

type ActivityTab = "seller" | "buyer";
type ProductStatus = "active" | "reserved" | "sold" | "deleted";

type ContactedProduct = {
  productId: string;
  count: number;
  lastAt: Date;
  product?: Product | null;
};

function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof (value as { toDate?: unknown }).toDate === "function"
  ) {
    return (value as { toDate: () => Date }).toDate();
  }
  return null;
}

function SellerActivity({ userId }: { userId: string }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [contactCounts, setContactCounts] = useState<Record<string, number>>(
    {}
  );
  const [pendingOrders, setPendingOrders] = useState<Order[]>([]);
  const [reservedForInputs, setReservedForInputs] = useState<
    Record<string, string>
  >({});
  const [reservedAssignments, setReservedAssignments] = useState<
    Record<string, { email: string; userId: string; name?: string | null }>
  >({});
  const [buyerProfiles, setBuyerProfiles] = useState<
    Record<string, { displayName: string | null; email: string | null }>
  >({});
  const [buyerProfilesForOrders, setBuyerProfilesForOrders] = useState<
    Record<string, { displayName: string | null; email: string | null }>
  >({});
  const [dealModal, setDealModal] = useState<{
    productId: string;
    type: "sale" | "donation" | "trade" | "permuta";
    email: string;
    items: string;
    price: string;
  } | null>(null);
  const [deleteModal, setDeleteModal] = useState<{
    productId: string;
    title: string;
  } | null>(null);
  const [showSold, setShowSold] = useState(false);
  const [dealModalError, setDealModalError] = useState<string | null>(null);
  const [dealModalSaving, setDealModalSaving] = useState(false);
  const [alertModal, setAlertModal] = useState<{
    title: string;
    description: string;
    tone?: "info" | "error" | "success";
  } | null>(null);
  const [confirmOrderModal, setConfirmOrderModal] = useState<{
    orderId: string;
    productTitle: string;
    price: number;
  } | null>(null);
  const [pendingActionModal, setPendingActionModal] = useState<{
    orderId: string;
    action: "confirm" | "reject";
    productTitle: string;
  } | null>(null);
  const [orderActionLoading, setOrderActionLoading] = useState(false);
  const [pageSize, setPageSize] = useState(DEFAULT_DASHBOARD_PAGE_SIZE);
  const [currentPage, setCurrentPage] = useState(1);

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

  useEffect(() => {
    const fetchPendingOrders = async () => {
      try {
        const q = query(
          collection(db, "orders"),
          where("sellerId", "==", userId),
          where("status", "==", "pending")
        );
        const snap = await getDocs(q);
        const orders = snap.docs.map((d) => {
             const data = d.data();
             return {
                 id: d.id,
                 ...data,
                 createdAt: toDate(data.createdAt) ?? new Date(),
             } as Order;
        });
        setPendingOrders(orders);
      } catch (e) {
        console.error("Error fetching pending orders", e);
      }
    };
    fetchPendingOrders();
  }, [userId]);

  useEffect(() => {
    const loadPendingOrderBuyers = async () => {
      const toFetch = pendingOrders
        .map((o) => o.buyerId)
        .filter((id) => id && !buyerProfilesForOrders[id]);

      for (const uid of toFetch) {
        try {
          const snap = await getDoc(doc(db, "users", uid));
          const data = snap.exists()
            ? (snap.data() as { displayName?: string | null; email?: string | null })
            : null;
          setBuyerProfilesForOrders((prev) => ({
            ...prev,
            [uid]: {
              displayName: data?.displayName ?? null,
              email: data?.email ?? null,
            },
          }));
        } catch (error) {
          console.error("Error fetching pending order buyer profile", { uid, error });
          setBuyerProfilesForOrders((prev) => ({
            ...prev,
            [uid]: { displayName: null, email: null },
          }));
        }
      }
    };
    void loadPendingOrderBuyers();
  }, [pendingOrders, buyerProfilesForOrders]);

  useEffect(() => {
    const loadBuyerProfiles = async () => {
      const ids = new Set<string>();
      products.forEach((p) => {
        if (p.finalBuyerUserId) ids.add(p.finalBuyerUserId);
        else if (p.reservedForUserId) ids.add(p.reservedForUserId);
      });
      const toFetch = Array.from(ids).filter((id) => !buyerProfiles[id]);
      for (const uid of toFetch) {
        try {
          const snap = await getDoc(doc(db, "users", uid));
          const data = snap.exists()
            ? (snap.data() as { displayName?: string | null; email?: string | null })
            : null;
          setBuyerProfiles((prev) => ({
            ...prev,
            [uid]: {
              displayName: data?.displayName ?? null,
              email: data?.email ?? null,
            },
          }));
        } catch (error) {
          console.error("Error fetching buyer profile", { uid, error });
          setBuyerProfiles((prev) => ({
            ...prev,
            [uid]: { displayName: null, email: null },
          }));
        }
      }
    };
    void loadBuyerProfiles();
  }, [products, buyerProfiles]);

  useEffect(() => {
    const loadBuyers = async () => {
      const toFetch = Array.from(
        new Set(
          products
            .filter(
              (p) => p.status === "sold" && p.finalBuyerUserId && !buyerProfiles[p.finalBuyerUserId]
            )
            .map((p) => p.finalBuyerUserId as string)
        )
      );
      for (const uid of toFetch) {
        try {
          const snap = await getDoc(doc(db, "users", uid));
          const data = snap.exists()
            ? (snap.data() as { displayName?: string | null; email?: string | null })
            : null;
          setBuyerProfiles((prev) => ({
            ...prev,
            [uid]: {
              displayName: data?.displayName ?? null,
              email: data?.email ?? null,
            },
          }));
        } catch (error) {
          console.error("Error fetching buyer profile", { uid, error });
          setBuyerProfiles((prev) => ({
            ...prev,
            [uid]: { displayName: null, email: null },
          }));
        }
      }
    };
    void loadBuyers();
  }, [products, buyerProfiles]);

  const processOrderAction = async (orderId: string, action: 'confirm' | 'reject') => {
    try {
      setOrderActionLoading(true);
      const user = auth.currentUser;
      if (!user) {
        showAlert("Inicia sesión nuevamente para continuar.", { tone: "error", title: "Sesión expirada" });
        return;
      }
      if (!orderId) {
        showAlert("Orden inválida", { tone: "error", title: "No se pudo procesar" });
        return;
      }
      const token = await user.getIdToken();

      const res = await fetch(`/api/orders/${orderId}/${action}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!res.ok) {
        let reason = "Failed to process order";
        try {
          const data = (await res.json()) as { error?: string };
          if (data?.error) reason = data.error;
          console.error(`processOrderAction ${action} failed`, { orderId, status: res.status, reason, response: data });
        } catch {
          // ignore
        }
        throw new Error(reason);
      }

      setPendingOrders(prev => prev.filter(o => o.id !== orderId));
      window.location.reload();
    } catch (e) {
      console.error(e);
      showAlert(
        (e as Error).message || "Error al procesar la solicitud",
        { tone: "error", title: "No se pudo procesar" }
      );
    } finally {
      setOrderActionLoading(false);
    }
  };

  useEffect(() => {
    const fetchMyProducts = async () => {
      setLoadingProducts(true);
      try {
        const q = query(
          collection(db, "products"),
          where("sellerId", "==", userId)
        );

        const snapshot = await getDocs(q);
        const productsData = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            ...data,
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
          };
        }) as Product[];

        const visibleProducts = productsData
          .filter((p) => p.status !== "deleted")
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

        setProducts(visibleProducts);
        setReservedForInputs(
          Object.fromEntries(
            visibleProducts.map((p) => [p.id!, p.reservedForContact ?? ""])
          )
        );
        setReservedAssignments(
          Object.fromEntries(
            visibleProducts
              .filter((p) => p.reservedForUserId && p.reservedForContact)
              .map((p) => [
                p.id!,
                {
                  email: p.reservedForContact as string,
                  userId: p.reservedForUserId as string,
                  name: undefined,
                },
              ])
          )
        );

        const entries = await Promise.all(
          visibleProducts.map(async (product) => {
            try {
              const count = await getContactClicksCount(product.id!, userId);
              return [product.id!, count] as const;
            } catch (error) {
              console.error("Error obteniendo clics de contacto:", error);
              return [product.id!, 0] as const;
            }
          })
        );
        setContactCounts(Object.fromEntries(entries));
      } catch (error) {
        console.error("Error fetching products:", error);
      } finally {
        setLoadingProducts(false);
      }
    };

    fetchMyProducts();
  }, [userId]);

  useEffect(() => {
    setCurrentPage(1);
  }, [pageSize, showSold, products.length]);

  const handleStatusChange = async (
    productId: string,
    newStatus: ProductStatus,
    options?: {
      skipPrompt?: boolean;
      reservedForContact?: string | null;
      reservedForUserId?: string | null;
      finalizeData?: {
        email: string;
        userId: string;
        price?: number | null;
        items?: string | null;
      };
    }
  ) => {
    const product = products.find((p) => p.id === productId);
    if (!product) {
      showAlert("No pudimos encontrar esta publicacion en tu lista actual.", {
        tone: "error",
        title: "Publicación no encontrada",
      });
      return;
    }

    const skipConfirm = options?.skipPrompt || (newStatus === "sold" && options?.finalizeData);
    if (!skipConfirm) {
      if (
        !confirm(
          `Estas seguro de cambiar el estado a ${
            newStatus === "deleted" ? "ELIMINADO" : newStatus
          }?`
        )
      )
        return;
    }

    try {
      const productRef = doc(db, "products", productId);
      const updateData: Partial<Product> = { status: newStatus };

      if (newStatus === "active") {
        updateData.reservedForContact = null;
        updateData.reservedForUserId = null;
        updateData.finalBuyerUserId = null;
        updateData.finalBuyerContact = null;
        updateData.finalDealPrice = null;
        updateData.finalDealItems = null;
        updateData.finalizedAt = null;
      } else if (options) {
        if (options.reservedForContact !== undefined) {
          updateData.reservedForContact =
            options.reservedForContact && options.reservedForContact.trim().length > 0
              ? options.reservedForContact.trim()
              : null;
        }
        if (options.reservedForUserId !== undefined) {
          updateData.reservedForUserId = options.reservedForUserId;
        }
      }

      if (newStatus === "sold") {
        if (!options?.finalizeData?.userId || !options.finalizeData.email) {
          showAlert(
            "Debes asignar un correo válido de usuario antes de cerrar la operación.",
            { tone: "error", title: "Falta correo del comprador" }
          );
          return;
        }

        const finalDealPrice =
          options.finalizeData.price === undefined
            ? product.price ?? null
            : options.finalizeData.price;

        updateData.reservedForContact = options.finalizeData.email;
        updateData.reservedForUserId = options.finalizeData.userId;
        updateData.finalBuyerUserId = options.finalizeData.userId;
        updateData.finalBuyerContact = options.finalizeData.email;
        updateData.finalDealPrice = finalDealPrice ?? null;
        updateData.finalDealItems = options.finalizeData.items ?? null;
        updateData.finalizedAt = serverTimestamp();
      }

      await updateDoc(productRef, updateData);

      if (newStatus === "deleted") {
        setProducts((prev) => prev.filter((p) => p.id !== productId));
      } else {
        setProducts((prev) =>
          prev.map((p) =>
            p.id === productId
              ? {
                  ...p,
                  ...updateData,
                  reservedForContact: updateData.reservedForContact ?? p.reservedForContact,
                  reservedForUserId:
                    updateData.reservedForUserId === undefined
                      ? p.reservedForUserId
                      : updateData.reservedForUserId,
                  finalBuyerContact:
                    updateData.finalBuyerContact === undefined
                      ? p.finalBuyerContact
                      : updateData.finalBuyerContact,
                  finalBuyerUserId:
                    updateData.finalBuyerUserId === undefined
                      ? p.finalBuyerUserId
                      : updateData.finalBuyerUserId,
                  finalizedAt:
                    newStatus === "sold"
                      ? new Date()
                      : newStatus === "active"
                      ? null
                      : p.finalizedAt,
                }
              : p
          )
        );
        if (newStatus === "active") {
          setReservedForInputs((prev) => ({ ...prev, [productId]: "" }));
        }
        if (newStatus === "sold" && options?.finalizeData) {
          const finalizeData = options.finalizeData;
          setReservedAssignments((prev) => ({
            ...prev,
            [productId]: {
              email: finalizeData.email,
              userId: finalizeData.userId,
              name: prev[productId]?.name,
            },
          }));
          setReservedForInputs((prev) => ({
            ...prev,
            [productId]: finalizeData.email,
          }));
        }
      }
    } catch (error) {
      console.error("Error updating status:", error);
      showAlert("Error al actualizar el estado", { tone: "error", title: "No se guardó el cambio" });
    }
  };
  const activeReservedProducts = products.filter(
    (p) => p.status === "active" || p.status === "reserved"
  );
  const soldProducts = products.filter((p) => p.status === "sold");
  const visibleProducts = [
    ...activeReservedProducts,
    ...(showSold ? soldProducts : []),
  ];
  const totalPages = Math.max(
    1,
    Math.ceil(Math.max(visibleProducts.length, 1) / pageSize)
  );
  const currentPageSafe = Math.min(currentPage, totalPages);
  const paginatedProducts = visibleProducts.slice(
    (currentPageSafe - 1) * pageSize,
    currentPageSafe * pageSize
  );

  const getAcceptedTypes = (product: Product) => {
    const accepted = product.acceptedExchangeTypes
      ? [...product.acceptedExchangeTypes]
      : [];
    if (accepted.length === 0) {
      if (product.mode === "sale") accepted.push("money");
      else if (product.mode === "trade") accepted.push("product");
      else if (product.mode === "both") {
        accepted.push("money", "product");
      }
    }
    return accepted;
  };

  const getDealType = (
    product: Product
  ): "sale" | "donation" | "trade" | "permuta" => {
    const accepted = getAcceptedTypes(product);
    const isGiveaway = accepted.includes("giveaway");
    const hasPermuta = accepted.includes("exchange_plus_cash");
    const hasTrade = accepted.some((t) => t === "product" || t === "service" || t === "exchange_plus_cash");
    if (isGiveaway) return "donation";
    if (hasPermuta) return "permuta";
    if (hasTrade) return "trade";
    return "sale";
  };

  const getSoldLabel = (product: Product) => {
    const type = getDealType(product);
    if (type === "donation") return "DONADO";
    if (type === "permuta" || type === "trade") return "TRUQUEADO";
    return "VENDIDO";
  };

  const getBuyerLabel = (product: Product) => {
    const userId = product.finalBuyerUserId ?? product.reservedForUserId ?? null;
    const contact = product.finalBuyerContact ?? product.reservedForContact ?? null;
    const profile = userId ? buyerProfiles[userId] : null;

    if (profile?.displayName && profile?.email) {
      return `${profile.displayName} (${profile.email})`;
    }
    if (profile?.displayName) return profile.displayName;
    if (profile?.email) return profile.email;
    if (contact) return contact;
    return "No registrado";
  };

  const getActionLabel = (product: Product) => {
    const type = getDealType(product);
    if (type === "donation") return "Donar";
    if (type === "permuta" || type === "trade") return "Truequear";
    return "Vender";
  };

  const assignUserByEmail = async (productId: string, emailInput: string) => {
    const email = emailInput.trim().toLowerCase();
    if (!email || !email.includes("@")) {
      showAlert("Ingresa un correo válido para asignar.", {
        tone: "error",
        title: "Correo inválido",
      });
      return;
    }
    try {
      const q = query(
        collection(db, "users"),
        where("email", "==", email)
      );
      const snap = await getDocs(q);
      if (snap.empty) {
        showAlert("No encontramos un usuario con ese correo.", {
          tone: "info",
          title: "Usuario no encontrado",
        });
        return;
      }
      const userDoc = snap.docs[0];
      const data = userDoc.data() as { email?: string; displayName?: string };
      setReservedAssignments((prev) => ({
        ...prev,
        [productId]: {
          email: data.email || email,
          userId: userDoc.id,
          name: data.displayName ?? undefined,
        },
      }));
      setReservedForInputs((prev) => ({ ...prev, [productId]: data.email || email }));
    } catch (e) {
      console.error("Error buscando usuario:", e);
      showAlert("Ocurrió un error al buscar el usuario.", {
        tone: "error",
        title: "No se pudo buscar",
      });
    }
  };


  const openFinalizeModal = (product: Product) => {
    const type = getDealType(product);
    const preEmail =
      reservedAssignments[product.id!]?.email ||
      reservedForInputs[product.id!] ||
      product.reservedForContact ||
      "";
    const pricePrefill =
      type === "permuta" ? (product.price != null ? String(product.price) : "0") : "";

    setDealModal({
      productId: product.id!,
      type,
      email: preEmail,
      items: "",
      price: pricePrefill,
    });
    setDealModalError(null);
    setDealModalSaving(false);
  };

  const finalizeWithModal = async () => {
    if (!dealModal) return;
    setDealModalError(null);
    setDealModalSaving(true);
    try {
      const email = dealModal.email.trim().toLowerCase();
      if (!email || !email.includes("@")) {
        setDealModalError("Ingresa un correo válido.");
        setDealModalSaving(false);
        return;
      }

      let userId: string | null = null;
      try {
        const q = query(collection(db, "users"), where("email", "==", email));
        const snap = await getDocs(q);
        if (!snap.empty) {
          userId = snap.docs[0].id;
        }
      } catch (e) {
        console.error("Error buscando usuario para finalizar:", e);
      }
      if (!userId) {
        setDealModalError("No encontramos un usuario con ese correo.");
        setDealModalSaving(false);
        return;
      }

      let items: string | null = null;
      let price: number | null | undefined = undefined;

      if (dealModal.type === "trade" || dealModal.type === "permuta") {
        if (!dealModal.items.trim()) {
          setDealModalError("Ingresa el producto o servicio ofrecido.");
          setDealModalSaving(false);
          return;
        }
        items = dealModal.items.trim();
      }

      if (dealModal.type === "permuta") {
        const parsed = Number(dealModal.price);
        if (Number.isNaN(parsed) || parsed < 0) {
          setDealModalError("Ingresa un monto válido para la diferencia pagada.");
          setDealModalSaving(false);
          return;
        }
        price = parsed;
      }

      await handleStatusChange(dealModal.productId, "sold", {
        finalizeData: {
          email,
          userId,
          price,
          items,
        },
      });
      setDealModal(null);
    } finally {
      setDealModalSaving(false);
    }
  };

  return (
    <>
    <div>
      {pendingOrders.length > 0 && (
        <div className="mb-8 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-900/50 rounded-lg p-6 shadow-sm transition-colors">
          <h3 className="font-bold text-yellow-800 dark:text-yellow-200 text-lg mb-4 flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            Solicitudes Pendientes
          </h3>
          <div className="space-y-4">
                {pendingOrders.map((order) => (
                  <div key={order.id} className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-yellow-100 dark:border-yellow-900/30 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 transition-colors">
                     <div>
                       <p className="font-semibold text-gray-900 dark:text-white">{order.productTitle}</p>
                     <p className="text-sm text-gray-600 dark:text-gray-400">
                       {(() => {
                         const buyer = buyerProfilesForOrders[order.buyerId];
                         if (buyer?.displayName && buyer?.email) {
                           return `Comprador: ${buyer.displayName} (${buyer.email})`;
                         }
                         if (buyer?.displayName) return `Comprador: ${buyer.displayName}`;
                         if (buyer?.email) return `Comprador: ${buyer.email}`;
                         return `Comprador ID: ${order.buyerId.slice(0, 8)}...`;
                       })()}
                     </p>
                     <p className="text-sm text-gray-500 dark:text-gray-400">{order.createdAt.toLocaleString("es-PE")}</p>
                     <p className="font-bold text-indigo-600 dark:text-indigo-400 mt-1">
                       S/. {typeof order.price === "number" ? order.price.toLocaleString("es-PE") : "0"}
                     </p>
                  </div>
                 <div className="flex gap-2 w-full md:w-auto">
                    <Button
                      onClick={() =>
                        setPendingActionModal({
                          orderId: order.id,
                          action: "confirm",
                          productTitle: order.productTitle,
                        })
                      }
                      className="bg-green-600 hover:bg-green-700 dark:bg-green-600 dark:hover:bg-green-500 flex-1 md:flex-none"
                    >
                        Confirmar Venta
                    </Button>
                    <Button
                      onClick={() =>
                        setPendingActionModal({
                          orderId: order.id,
                          action: "reject",
                          productTitle: order.productTitle,
                        })
                      }
                      variant="outline"
                      className="text-red-600 border-red-200 hover:bg-red-50 dark:text-red-400 dark:border-red-900 dark:hover:bg-red-900/20 flex-1 md:flex-none"
                    >
                        Rechazar
                    </Button>
                 </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg transition-colors">
          <div className="px-4 py-5 sm:p-6">
            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
              Total Publicaciones
            </dt>
            <dd className="mt-1 text-3xl font-semibold text-gray-900 dark:text-white">
              {products.length}
            </dd>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg transition-colors">
          <div className="px-4 py-5 sm:p-6">
            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
              Publicaciones activas
            </dt>
            <dd className="mt-1 text-3xl font-semibold text-gray-900 dark:text-white">
              {products.filter((p) => p.status === "active").length}
            </dd>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg transition-colors">
          <div className="px-4 py-5 sm:p-6">
            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
              En Negociacion
            </dt>
            <dd className="mt-1 text-3xl font-semibold text-gray-900 dark:text-white">
              {products.filter((p) => p.status === "reserved").length}
            </dd>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg transition-colors">
          <div className="px-4 py-5 sm:p-6">
            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
              Concretadas
            </dt>
            <dd className="mt-1 text-3xl font-semibold text-gray-900 dark:text-white">
              {products.filter((p) => p.status === "sold").length}
            </dd>
          </div>
        </div>
      </div>

      {soldProducts.length > 0 && (
        <div className="flex justify-end mb-4">
          <button
            type="button"
            onClick={() => setShowSold((prev) => !prev)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            {showSold ? "Ocultar concretadas" : "Ver concretadas"}
            <span className="inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs font-semibold bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200">
              {soldProducts.length}
            </span>
          </button>
        </div>
      )}

      {visibleProducts.length > 0 && !loadingProducts && (
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
          <div className="text-sm text-gray-600 dark:text-gray-300">
            Mostrando {paginatedProducts.length} de {visibleProducts.length} publicaciones
          </div>
          <div className="flex items-center gap-3">
            <label className="text-sm text-gray-600 dark:text-gray-300">
              Por página:
            </label>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm px-3 py-1"
            >
              {PAGE_SIZE_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                disabled={currentPageSafe <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              >
                Anterior
              </Button>
              <span className="text-sm text-gray-700 dark:text-gray-200">
                {currentPageSafe} / {totalPages}
              </span>
              <Button
                variant="outline"
                disabled={currentPageSafe >= totalPages}
                onClick={() =>
                  setCurrentPage((p) =>
                    p + 1 > totalPages ? totalPages : p + 1
                  )
                }
              >
                Siguiente
              </Button>
            </div>
          </div>
        </div>
      )}

      {loadingProducts ? (
        <div className="text-center py-10 text-gray-600 dark:text-gray-400">Cargando tus productos...</div>
      ) : visibleProducts.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg shadow transition-colors">
          <svg
            className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
            />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
            No tienes publicaciones para mostrar
          </h3>
          <div className="mt-6">
            <Link href="/products/new">
              <Button>Crear primera publicacion</Button>
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {paginatedProducts.map((product) => (
            <div
              key={product.id}
              className="flex flex-col md:flex-row md:items-center justify-between p-4 border dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 gap-4 bg-white dark:bg-gray-800 shadow-sm transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className="relative h-16 w-16 flex-shrink-0 bg-gray-100 dark:bg-gray-700 rounded-md flex items-center justify-center overflow-hidden">
                  {product.images && product.images.length > 0 ? (
                    <Image
                      src={product.images[0]}
                      alt={product.title}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <span className="text-2xl" role="img" aria-label="icon">
                      {product.listingType === 'service' ? '🛠️' : '📦'}
                    </span>
                  )}
                </div>
                <div>
                  <h3 className="font-medium text-gray-900 dark:text-white">
                    <Link
                      href={`/products/${product.id}`}
                      className="hover:underline"
                    >
                      {product.title}
                    </Link>
                  </h3>
                  {(() => {
                    const accepted = getAcceptedExchangeTypes(product);
                    const showsMoney =
                      accepted.includes("money") || accepted.includes("exchange_plus_cash");
                    if (product.price != null) {
                      return (
                        <p className="text-indigo-600 dark:text-indigo-400 font-bold">
                          {showsMoney
                            ? `S/. ${product.price.toLocaleString("es-PE")}`
                            : `Valor referencial: S/. ${product.price.toLocaleString("es-PE")}`}
                        </p>
                      );
                    }
                    return (
                      <p className="text-indigo-600 dark:text-indigo-400 font-bold">
                        Sin precio
                      </p>
                    );
                  })()}
                  <p className="text-sm text-gray-500 dark:text-gray-400 md:hidden">
                    {product.createdAt.toLocaleDateString("es-PE")}
                  </p>
            <div className="mt-1 md:hidden">
              <span
                className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                  product.status === "active"
                    ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                  : product.status === "reserved"
                  ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300"
                  : "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300"
                }`}
              >
                {product.status === "active"
                  ? "Activo"
                  : product.status === "reserved"
                  ? "Reservado"
                  : getSoldLabel(product)}
            </span>
          </div>
                  <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Clics en Contactar:{" "}
                    <span className="font-semibold text-gray-800 dark:text-gray-200">
                      {contactCounts[product.id!] ?? 0}
                    </span>
                  </div>
                </div>
              </div>

              <div className="hidden md:block text-sm text-gray-500 dark:text-gray-400">
                {product.createdAt.toLocaleDateString("es-PE")}
              </div>

              <div className="hidden md:block">
                <span
                  className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                    product.status === "active"
                      ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                      : product.status === "reserved"
                      ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300"
                      : "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300"
                  }`}
                >
                  {product.status === "active"
                    ? "Activo"
                    : product.status === "reserved"
                    ? "Reservado"
                    : getSoldLabel(product)}
                </span>
              </div>

              <div className="flex-1 md:flex-none md:w-60 text-sm text-gray-600 dark:text-gray-300">
                {product.reservedForContact ? (
                  <p className="mb-1">
                    <span className="font-semibold">Reservado para:</span>{" "}
                    {product.reservedForContact}
                  </p>
                ) : (
                  <p className="mb-1 text-gray-500 dark:text-gray-400">
                    Sin comprador asignado
                  </p>
                )}
                <div className="flex gap-2 mt-1">
                  <input
                    type="email"
                    value={reservedForInputs[product.id!] ?? ""}
                    onChange={(e) =>
                      setReservedForInputs((prev) => ({
                        ...prev,
                        [product.id!]: e.target.value,
                      }))
                    }
                    placeholder="Correo del comprador"
                    className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 p-2 text-xs focus:border-indigo-500 focus:ring-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      assignUserByEmail(product.id!, reservedForInputs[product.id!] ?? "")
                    }
                    className="px-3 py-2 text-xs font-medium bg-indigo-600 text-white rounded-md hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-400 transition-colors"
                  >
                    Asignar
                  </button>
                </div>
                {reservedAssignments[product.id!] && (
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    Asignado a: {reservedAssignments[product.id!].email}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
                {product.status !== "sold" ? (
                  <>
                    <Link href={`/products/${product.id}/edit`} className="flex-1 md:flex-none">
                        <button className="w-full text-center px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-700 rounded-md hover:bg-gray-100 dark:hover:bg-gray-600 border border-gray-200 dark:border-gray-600 transition-colors">
                            Editar
                        </button>
                    </Link>
                    {product.status === "active" ? (
                      <button
                        onClick={() =>
                          handleStatusChange(
                            product.id!,
                            "reserved",
                            reservedAssignments[product.id!]
                              ? {
                                  reservedForContact: reservedAssignments[product.id!].email,
                                  reservedForUserId: reservedAssignments[product.id!].userId,
                                }
                              : undefined
                          )
                        }
                        className="flex-1 md:flex-none text-center px-3 py-2 text-sm font-medium text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 rounded-md hover:bg-yellow-100 dark:hover:bg-yellow-900/40 transition-colors"
                      >
                        Reservar
                      </button>
                    ) : (
                      <button
                        onClick={() => handleStatusChange(product.id!, "active")}
                        className="flex-1 md:flex-none text-center px-3 py-2 text-sm font-medium text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 rounded-md hover:bg-green-100 dark:hover:bg-green-900/40 transition-colors"
                      >
                        Disponible
                      </button>
                    )}
                    <button
                      onClick={() => openFinalizeModal(product)}
                      className="flex-1 md:flex-none text-center px-3 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
                    >
                      {getActionLabel(product)}
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => handleStatusChange(product.id!, "active")}
                    className="flex-1 md:flex-none text-center px-3 py-2 text-sm font-medium text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 rounded-md hover:bg-green-100 dark:hover:bg-green-900/40 transition-colors"
                  >
                    Republicar
                  </button>
                )}
                <button
                  onClick={() =>
                    setDeleteModal({ productId: product.id!, title: product.title })
                  }
                  className="flex-1 md:flex-none text-center px-3 py-2 text-sm font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-md hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
                >
                  Eliminar
                </button>
              </div>

              {product.status === "sold" && (
                <div className="w-full bg-gray-50 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700 rounded-md p-3 text-sm text-gray-700 dark:text-gray-200">
                  <p className="font-semibold mb-2 text-gray-900 dark:text-white">
                    Detalle de la operación
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <span className="text-xs text-gray-500 dark:text-gray-400">Tipo</span>
                      <p className="font-medium">{getSoldLabel(product)}</p>
                    </div>
                    <div>
                      <span className="text-xs text-gray-500 dark:text-gray-400">Usuario</span>
                      <p className="font-medium">{getBuyerLabel(product)}</p>
                    </div>
                    {product.finalDealPrice != null && (
                      <div>
                        <span className="text-xs text-gray-500 dark:text-gray-400">Monto</span>
                        <p className="font-medium">S/. {product.finalDealPrice.toLocaleString("es-PE")}</p>
                      </div>
                    )}
                    {product.finalDealItems && (
                      <div className="sm:col-span-2">
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          Productos o servicios involucrados
                        </span>
                        <p className="font-medium break-words">{product.finalDealItems}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {dealModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => (dealModalSaving ? null : setDealModal(null))}
          />
          <div className="relative w-full max-w-lg bg-white dark:bg-gray-900 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm uppercase text-gray-500 dark:text-gray-400 tracking-wide">
                  Confirmar {dealModal.type === "donation" ? "donación" : dealModal.type === "permuta" ? "permuta" : dealModal.type === "trade" ? "trueque" : "venta"}
                </p>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Completa los datos finales
                </h3>
              </div>
              <button
                onClick={() => (dealModalSaving ? null : setDealModal(null))}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                aria-label="Cerrar"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-3">
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-800 dark:text-gray-200">
                  Correo de la persona
                </label>
                <input
                  type="email"
                  value={dealModal.email}
                  onChange={(e) =>
                    setDealModal((prev) => (prev ? { ...prev, email: e.target.value } : prev))
                  }
                  className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 p-2 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                  placeholder="correo@ejemplo.com"
                  disabled={dealModalSaving}
                />
              </div>

              {(dealModal.type === "trade" || dealModal.type === "permuta") && (
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-gray-800 dark:text-gray-200">
                    Producto o servicio ofrecido al concretar
                  </label>
                  <textarea
                    value={dealModal.items}
                    onChange={(e) =>
                      setDealModal((prev) => (prev ? { ...prev, items: e.target.value } : prev))
                    }
                    rows={3}
                    className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 p-2 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                    placeholder="Ej: bicicleta usada + servicio de mantenimiento"
                    disabled={dealModalSaving}
                  />
                </div>
              )}

              {dealModal.type === "permuta" && (
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-gray-800 dark:text-gray-200">
                    Monto de diferencia pagado (S/.)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={dealModal.price}
                    onChange={(e) =>
                      setDealModal((prev) => (prev ? { ...prev, price: e.target.value } : prev))
                    }
                    className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 p-2 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                    placeholder="Ej: 150.00"
                    disabled={dealModalSaving}
                  />
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    El monto que pagó el interesado en la permuta (además del producto/servicio ofrecido).
                  </p>
                </div>
              )}

              {dealModalError && (
                <p className="text-sm text-red-600 dark:text-red-400">{dealModalError}</p>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => (dealModalSaving ? null : setDealModal(null))}
                className="px-4 py-2 text-sm font-medium rounded-md border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                disabled={dealModalSaving}
              >
                Cancelar
              </button>
              <button
                onClick={finalizeWithModal}
                className="px-4 py-2 text-sm font-semibold rounded-md bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-400 disabled:opacity-60"
                disabled={dealModalSaving}
              >
                {dealModalSaving ? "Guardando..." : "Confirmar operación"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>

    <AlertModal
      open={!!alertModal}
      title={alertModal?.title ?? ""}
      description={alertModal?.description ?? ""}
      tone={alertModal?.tone}
      onClose={() => setAlertModal(null)}
    />
    {deleteModal && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6">
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-md w-full p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm uppercase text-gray-500 dark:text-gray-400 tracking-wide">
                Confirmar eliminación
              </p>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                ¿Eliminar esta publicación?
              </h3>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-300 break-words">
                {deleteModal.title}
              </p>
            </div>
            <button
              onClick={() => setDeleteModal(null)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              aria-label="Cerrar"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <button
              onClick={() => setDeleteModal(null)}
              className="px-4 py-2 text-sm font-medium rounded-md border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={async () => {
                if (!deleteModal) return;
                await handleStatusChange(deleteModal.productId, "deleted", { skipPrompt: true });
                setDeleteModal(null);
              }}
              className="px-4 py-2 text-sm font-semibold rounded-md bg-red-600 text-white hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-400"
            >
              Eliminar
            </button>
          </div>
        </div>
      </div>
    )}
    {confirmOrderModal && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6">
        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-md border border-gray-200 dark:border-gray-800 p-6 space-y-4">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-100">
              Confirmar venta
            </span>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {confirmOrderModal.productTitle}
            </h3>
          </div>
          <p className="text-sm text-gray-700 dark:text-gray-200">
            Se registrará la venta por{" "}
            <strong>
              S/.{" "}
              {typeof confirmOrderModal.price === "number"
                ? confirmOrderModal.price.toLocaleString("es-PE")
                : "0"}
            </strong>. ¿Deseas continuar?
          </p>
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => setConfirmOrderModal(null)}
              disabled={orderActionLoading}
            >
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (confirmOrderModal) {
                  void processOrderAction(confirmOrderModal.orderId, 'confirm');
                }
                setConfirmOrderModal(null);
              }}
              disabled={orderActionLoading}
              className="bg-green-600 hover:bg-green-700 dark:bg-green-600 dark:hover:bg-green-500"
            >
              {orderActionLoading ? "Procesando..." : "Confirmar"}
            </Button>
          </div>
        </div>
      </div>
    )}
    {pendingActionModal && (
      <ConfirmModal
        open={true}
        title={pendingActionModal.action === "confirm" ? "Confirmar venta" : "Rechazar solicitud"}
        description={
          pendingActionModal.action === "confirm"
            ? "¿Deseas confirmar esta venta?"
            : "¿Deseas rechazar esta solicitud de compra?"
        }
        confirmLabel="Sí, continuar"
        cancelLabel="Cancelar"
        tone={pendingActionModal.action === "confirm" ? "default" : "destructive"}
        loading={orderActionLoading}
        onConfirm={() => {
          void processOrderAction(pendingActionModal.orderId, pendingActionModal.action);
          setPendingActionModal(null);
        }}
        onCancel={() => setPendingActionModal(null)}
      />
    )}
    </>
  );
}

function BuyerActivity({ userId }: { userId: string }) {
  const [contacted, setContacted] = useState<ContactedProduct[]>([]);
  const [loadingContacted, setLoadingContacted] = useState(true);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [sellerContacts, setSellerContacts] = useState<
    Record<string, { phoneNumber?: string | null; name?: string | null }>
  >({});
  const [alertModal, setAlertModal] = useState<{
    title: string;
    description: string;
    tone?: "info" | "error" | "success";
  } | null>(null);

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

  useEffect(() => {
    const fetchContacted = async () => {
      setLoadingContacted(true);
      try {
        const q = query(
          collectionGroup(db, "contactLogs"),
          where("userId", "==", userId)
        );

        const snapshot = await getDocs(q);

        const grouped = new Map<string, { count: number; lastAt: Date }>();
        for (const docSnap of snapshot.docs) {
          const data = docSnap.data();
          const createdAt = toDate(data.createdAt) ?? new Date(0);
          const productId = docSnap.ref.parent.parent?.id;
          if (!productId) continue;

          const current = grouped.get(productId);
          if (!current) {
            grouped.set(productId, { count: 1, lastAt: createdAt });
          } else {
            grouped.set(productId, {
              count: current.count + 1,
              lastAt: current.lastAt > createdAt ? current.lastAt : createdAt,
            });
          }
        }

        const entries = await Promise.all(
          Array.from(grouped.entries()).map(async ([productId, info]): Promise<ContactedProduct | null> => {
            try {
              const productSnap = await getDoc(doc(db, "products", productId));
              if (!productSnap.exists()) {
                return { productId, ...info, product: null };
              }
              const data = productSnap.data();
              if ((data.status ?? "active") === "deleted") {
                return null;
              }
              const product = {
                id: productSnap.id,
                ...data,
                createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
                mode: data.mode ?? "sale",
              } as Product;

              return { productId, ...info, product };
            } catch (error) {
              console.error("Error fetching product for contact log:", error);
              return { productId, ...info, product: null };
            }
          })
        );

        const filteredEntries = entries.filter(
          (entry): entry is ContactedProduct => entry !== null
        );

        filteredEntries.sort((a, b) => b.lastAt.getTime() - a.lastAt.getTime());
        setContacted(filteredEntries);
      } catch (error) {
        console.error("Error fetching contacted products:", error);
        setContacted([]);
      } finally {
        setLoadingContacted(false);
      }
    };

    const fetchOrders = async () => {
      setLoadingOrders(true);
      try {
        const q = query(
          collection(db, "orders"),
          where("buyerId", "==", userId)
        );

        const querySnapshot = await getDocs(q);
        const ordersData = querySnapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            ...data,
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
          };
        }) as Order[];

        const filteredOrders = ordersData.filter(
          (order) => (order as { status?: string }).status !== "deleted"
        );

        filteredOrders.sort((a, b) => {
          const dateA = toDate(a.createdAt) ?? new Date();
          const dateB = toDate(b.createdAt) ?? new Date();
          return dateB.getTime() - dateA.getTime();
        });
        setOrders(filteredOrders);

        const sellerIds = Array.from(new Set(filteredOrders.map((o) => o.sellerId)));
        const contactEntries = await Promise.all(
          sellerIds.map(async (sellerId) => {
            try {
              const sellerSnap = await getDoc(doc(db, "users", sellerId));
              if (sellerSnap.exists()) {
                const data = sellerSnap.data();
                return [
                  sellerId,
                  {
                    phoneNumber: data.phoneNumber,
                    name: data.displayName || data.email,
                  },
                ] as const;
              }
            } catch (error) {
              console.error("Error fetching seller contact:", error);
            }
            return [sellerId, { phoneNumber: null, name: null }] as const;
          })
        );
        setSellerContacts(Object.fromEntries(contactEntries));
      } catch (error) {
        console.error("Error fetching orders:", error);
        setOrders([]);
      } finally {
        setLoadingOrders(false);
      }
    };

    void fetchContacted();
    void fetchOrders();
  }, [userId]);

  const handleContactSeller = async (order: Order) => {
    const sellerContact = sellerContacts[order.sellerId];
    const phone = sellerContact?.phoneNumber;

    if (!phone) {
      showAlert("El vendedor no ha configurado su numero de WhatsApp.", {
        tone: "info",
        title: "WhatsApp no disponible",
      });
      return;
    }

    try {
      await logContactClick(order.productId, userId, order.sellerId, "whatsapp");
    } catch (error) {
      console.error("Error registrando clic de contacto:", error);
    }

    const normalizedPhone = phone.replace(/[^\d]/g, "");
    const productUrl = `${window.location.origin}/products/${order.productId}`;
    const message = encodeURIComponent(
      `Hola, vi tu producto "${order.productTitle}" en Truequéalope. ¿Sigue disponible?\n${productUrl}`
    );
    const waUrl = `https://wa.me/${normalizedPhone}?text=${message}`;
    window.open(waUrl, "_blank");
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <section className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700 transition-colors">
        <div className="px-5 py-4 border-b dark:border-gray-700">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Contactados</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Productos donde hiciste clic en contactar.
          </p>
        </div>

        {loadingContacted ? (
          <div className="p-6 text-center text-gray-600 dark:text-gray-400">Cargando...</div>
        ) : contacted.length === 0 ? (
          <div className="p-6 text-center text-gray-600 dark:text-gray-400">
            Aun no has contactado productos.
            <div className="mt-4">
              <Link href="/search">
                <Button variant="outline">Explorar productos</Button>
              </Link>
            </div>
          </div>
        ) : (
          <ul className="divide-y dark:divide-gray-700">
            {contacted.map((item) => {
              const product = item.product;
              const categoryName = product
                ? CATEGORIES.find((c) => c.id === product.categoryId)?.name ??
                  "Otro"
                : null;

              return (
                <li key={item.productId} className="p-4">
                  <div className="flex gap-4">
                    <div className="relative h-16 w-16 flex-shrink-0 rounded-md overflow-hidden bg-gray-100 dark:bg-gray-700">
                      {product?.images?.[0] ? (
                        <Image
                          src={product.images[0]}
                          alt={product.title}
                          fill
                          className="object-cover"
                        />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center text-xs text-gray-400">
                          Sin imagen
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold text-gray-900 dark:text-white truncate">
                            {product?.title ?? "Producto no disponible"}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {categoryName ? `${categoryName} · ` : ""}
                            Ultimo: {item.lastAt.toLocaleDateString("es-PE")}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-gray-500 dark:text-gray-400">Clics</p>
                          <p className="font-bold text-gray-900 dark:text-white">{item.count}</p>
                        </div>
                      </div>

                      <div className="mt-3 flex gap-2">
                        <Link href={`/products/${item.productId}`}>
                          <Button size="sm" variant="outline" className="dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700">
                            Ver
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700 transition-colors">
        <div className="px-5 py-4 border-b dark:border-gray-700">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Mis compras</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">Historial de compras.</p>
        </div>

        {loadingOrders ? (
          <div className="p-6 text-center text-gray-600 dark:text-gray-400">Cargando...</div>
        ) : orders.length === 0 ? (
          <div className="p-6 text-center text-gray-600 dark:text-gray-400">
            No has realizado compras aun.
            <div className="mt-4">
              <Link href="/search">
                <Button variant="outline">Explorar productos</Button>
              </Link>
            </div>
          </div>
        ) : (
          <ul className="divide-y dark:divide-gray-700">
            {orders.map((order) => {
              const priceText =
                typeof order.price === "number"
                  ? order.price.toLocaleString("es-PE")
                  : "N/D";

              return (
                <li key={order.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 dark:text-white truncate">
                        {order.productTitle}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {toDate(order.createdAt)?.toLocaleDateString("es-PE") ?? ""}
                      </p>
                      <p className="mt-1 text-sm font-bold text-gray-900 dark:text-gray-100">
                        S/. {priceText}
                      </p>
                    </div>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 capitalize">
                      {order.status === "completed" ? "Completado" : order.status}
                    </span>
                  </div>
                  <div className="mt-3 flex gap-2 flex-wrap">
                    <button
                      onClick={() => handleContactSeller(order)}
                      className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                    >
                      Contactar vendedor
                    </button>
                    <Link href={`/products/${order.productId}`}>
                      <Button size="sm" variant="outline" className="dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700">
                        Ver producto
                      </Button>
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <AlertModal
        open={!!alertModal}
        title={alertModal?.title ?? ""}
        description={alertModal?.description ?? ""}
        tone={alertModal?.tone}
        onClose={() => setAlertModal(null)}
      />
    </div>
  );
}

function ActivityContent() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<ActivityTab>("buyer");

  useEffect(() => {
    const t =
      typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("tab")
        : null;
    setTab(t === "buyer" ? "buyer" : "seller");
  }, []);

  const setTabAndUrl = (nextTab: ActivityTab) => {
    setTab(nextTab);
    const params = new URLSearchParams(
      typeof window !== "undefined" ? window.location.search : ""
    );
    params.set("tab", nextTab);
    router.replace(`/activity?${params.toString()}`);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
      </div>
    );
  }

  if (!user) {
    router.replace("/auth/login?next=/activity");
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 py-6 transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Actividad</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Vistas, contactos y compras en un solo lugar.
            </p>
          </div>
          <Link href="/products/new" className="w-fit">
            <Button>+ Publicar</Button>
          </Link>
        </div>

        <div className="border-b border-gray-200 dark:border-gray-700 mb-6 transition-colors">
          <nav className="-mb-px flex gap-6" aria-label="Tabs">
            <button
              type="button"
              onClick={() => setTabAndUrl("seller")}
              className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                tab === "seller"
                  ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400"
                  : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-gray-600"
              }`}
            >
              Como vendedor
            </button>
            <button
              type="button"
              onClick={() => setTabAndUrl("buyer")}
              className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                tab === "buyer"
                  ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400"
                  : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-gray-600"
              }`}
            >
              Como comprador
            </button>
          </nav>
        </div>

        {tab === "seller" ? (
          <SellerActivity userId={user.uid} />
        ) : (
          <BuyerActivity userId={user.uid} />
        )}
      </div>
    </div>
  );
}

export default function ActivityPage() {
  const ActivityNoSSR = useMemo(
    () =>
      dynamic(() => Promise.resolve(ActivityContent), {
        ssr: false,
        loading: () => (
          <div className="flex min-h-screen items-center justify-center">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
          </div>
        ),
      }),
    []
  );

  return <ActivityNoSSR />;
}
