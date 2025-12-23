"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { db, auth } from "@/lib/firebaseClient";
import { useAuth } from "@/hooks/useAuth";
import { Product } from "@/types/product";
import { Order } from "@/types/order";
import { Button } from "@/components/ui/Button";
import { getContactClicksCount, logContactClick } from "@/lib/contact";
import { CATEGORIES } from "@/lib/constants";

type ActivityTab = "seller" | "buyer";
type TabKey = "active" | "history";
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
  const [activeTab, setActiveTab] = useState<TabKey>("active");
  const [contactCounts, setContactCounts] = useState<Record<string, number>>(
    {}
  );
  const [pendingOrders, setPendingOrders] = useState<Order[]>([]);

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

  const handleOrderAction = async (orderId: string, action: 'confirm' | 'reject') => {
      if (!confirm(`¿Estás seguro de que quieres ${action === 'confirm' ? 'confirmar' : 'rechazar'} esta venta?`)) return;
      
      try {
          const user = auth.currentUser;
          if (!user) return;
          const token = await user.getIdToken();
          
          const res = await fetch(`/api/orders/${orderId}/${action}`, {
              method: 'POST',
              headers: {
                  'Authorization': `Bearer ${token}`
              }
          });
          
          if (!res.ok) throw new Error("Failed to process order");
          
          // Update local state
          setPendingOrders(prev => prev.filter(o => o.id !== orderId));
          // Refresh products to reflect status change
          window.location.reload(); // Simple refresh to sync all states
      } catch (e) {
          console.error(e);
          alert("Error al procesar la solicitud");
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

        const entries = await Promise.all(
          visibleProducts.map(async (product) => {
            try {
              const count = await getContactClicksCount(product.id!);
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

  const handleStatusChange = async (
    productId: string,
    newStatus: ProductStatus
  ) => {
    if (
      !confirm(
        `¿Estas seguro de cambiar el estado a ${
          newStatus === "deleted" ? "ELIMINADO" : newStatus
        }?`
      )
    )
      return;

    try {
      const productRef = doc(db, "products", productId);
      await updateDoc(productRef, { status: newStatus });

      if (newStatus === "deleted") {
        setProducts((prev) => prev.filter((p) => p.id !== productId));
      } else {
        setProducts((prev) =>
          prev.map((p) => (p.id === productId ? { ...p, status: newStatus } : p))
        );
      }
    } catch (error) {
      console.error("Error updating status:", error);
      alert("Error al actualizar el estado");
    }
  };

  const displayedProducts = products.filter((p) =>
    activeTab === "active"
      ? p.status === "active" || p.status === "reserved"
      : p.status === "sold"
  );

  return (
    <div>
      {pendingOrders.length > 0 && (
        <div className="mb-8 bg-yellow-50 border border-yellow-200 rounded-lg p-6 shadow-sm">
          <h3 className="font-bold text-yellow-800 text-lg mb-4 flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            Solicitudes Pendientes
          </h3>
          <div className="space-y-4">
            {pendingOrders.map((order) => (
              <div key={order.id} className="bg-white p-4 rounded-lg border border-yellow-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                 <div>
                    <p className="font-semibold text-gray-900">{order.productTitle}</p>
                    <p className="text-sm text-gray-600">Comprador ID: {order.buyerId.slice(0, 8)}...</p>
                    <p className="text-sm text-gray-500">{order.createdAt.toLocaleString()}</p>
                    <p className="font-bold text-indigo-600 mt-1">S/. {order.price.toLocaleString()}</p>
                 </div>
                 <div className="flex gap-2 w-full md:w-auto">
                    <Button onClick={() => handleOrderAction(order.id, 'confirm')} className="bg-green-600 hover:bg-green-700 flex-1 md:flex-none">
                        Confirmar Venta
                    </Button>
                    <Button onClick={() => handleOrderAction(order.id, 'reject')} variant="outline" className="text-red-600 border-red-200 hover:bg-red-50 flex-1 md:flex-none">
                        Rechazar
                    </Button>
                 </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3 mb-8">
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <dt className="text-sm font-medium text-gray-500 truncate">
              Total Publicaciones
            </dt>
            <dd className="mt-1 text-3xl font-semibold text-gray-900">
              {products.length}
            </dd>
          </div>
        </div>
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <dt className="text-sm font-medium text-gray-500 truncate">
              Ventas Realizadas
            </dt>
            <dd className="mt-1 text-3xl font-semibold text-gray-900">
              {products.filter((p) => p.status === "sold").length}
            </dd>
          </div>
        </div>
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <dt className="text-sm font-medium text-gray-500 truncate">
              En Negociacion
            </dt>
            <dd className="mt-1 text-3xl font-semibold text-gray-900">
              {products.filter((p) => p.status === "reserved").length}
            </dd>
          </div>
        </div>
      </div>

      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          <button
            onClick={() => setActiveTab("active")}
            className={`${
              activeTab === "active"
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
          >
            Activos y Reservados
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`${
              activeTab === "history"
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
          >
            Historial de Ventas
          </button>
        </nav>
      </div>

      {loadingProducts ? (
        <div className="text-center py-10">Cargando tus productos...</div>
      ) : displayedProducts.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
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
          <h3 className="mt-2 text-sm font-medium text-gray-900">
            {activeTab === "active"
              ? "No tienes publicaciones activas"
              : "No tienes ventas registradas"}
          </h3>
          {activeTab === "active" && (
            <div className="mt-6">
              <Link href="/products/new">
                <Button>Crear primera publicacion</Button>
              </Link>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {displayedProducts.map((product) => (
            <div
              key={product.id}
              className="flex flex-col md:flex-row md:items-center justify-between p-4 border rounded-lg hover:bg-gray-50 gap-4 bg-white shadow-sm"
            >
              <div className="flex items-center gap-4">
                <div className="relative h-16 w-16 flex-shrink-0">
                  <Image
                    src={
                      product.images[0] ||
                      "https://placehold.co/100x100?text=Imagen"
                    }
                    alt={product.title}
                    fill
                    className="object-cover rounded-md"
                  />
                </div>
                <div>
                  <h3 className="font-medium text-gray-900">
                    <Link
                      href={`/products/${product.id}`}
                      className="hover:underline"
                    >
                      {product.title}
                    </Link>
                  </h3>
                  <p className="text-indigo-600 font-bold">
                    {product.price != null
                      ? new Intl.NumberFormat("es-CL", {
                          style: "currency",
                          currency: "CLP",
                        }).format(product.price)
                      : "Sin precio"}
                  </p>
                  <p className="text-sm text-gray-500 md:hidden">
                    {product.createdAt.toLocaleDateString()}
                  </p>
                  <div className="mt-1 md:hidden">
                    <span
                      className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        product.status === "active"
                          ? "bg-green-100 text-green-800"
                          : product.status === "reserved"
                          ? "bg-yellow-100 text-yellow-800"
                          : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {product.status === "active"
                        ? "Activo"
                        : product.status === "reserved"
                        ? "Reservado"
                        : "Vendido"}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-gray-500">
                    Clics en Contactar:{" "}
                    <span className="font-semibold text-gray-800">
                      {contactCounts[product.id!] ?? 0}
                    </span>
                  </div>
                </div>
              </div>

              <div className="hidden md:block text-sm text-gray-500">
                {product.createdAt.toLocaleDateString()}
              </div>

              <div className="hidden md:block">
                <span
                  className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                    product.status === "active"
                      ? "bg-green-100 text-green-800"
                      : product.status === "reserved"
                      ? "bg-yellow-100 text-yellow-800"
                      : "bg-gray-100 text-gray-800"
                  }`}
                >
                  {product.status === "active"
                    ? "Activo"
                    : product.status === "reserved"
                    ? "Reservado"
                    : "Vendido"}
                </span>
              </div>

              <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
                {product.status !== "sold" ? (
                  <>
                    <Link href={`/products/${product.id}/edit`} className="flex-1 md:flex-none">
                        <button className="w-full text-center px-3 py-2 text-sm font-medium text-gray-600 bg-gray-50 rounded-md hover:bg-gray-100 border border-gray-200">
                            Editar
                        </button>
                    </Link>
                    {product.status === "active" ? (
                      <button
                        onClick={() => handleStatusChange(product.id!, "reserved")}
                        className="flex-1 md:flex-none text-center px-3 py-2 text-sm font-medium text-yellow-600 bg-yellow-50 rounded-md hover:bg-yellow-100"
                      >
                        Reservar
                      </button>
                    ) : (
                      <button
                        onClick={() => handleStatusChange(product.id!, "active")}
                        className="flex-1 md:flex-none text-center px-3 py-2 text-sm font-medium text-green-600 bg-green-50 rounded-md hover:bg-green-100"
                      >
                        Disponible
                      </button>
                    )}
                    <button
                      onClick={() => handleStatusChange(product.id!, "sold")}
                      className="flex-1 md:flex-none text-center px-3 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-md hover:bg-blue-100"
                    >
                      Vendido
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => handleStatusChange(product.id!, "active")}
                    className="flex-1 md:flex-none text-center px-3 py-2 text-sm font-medium text-green-600 bg-green-50 rounded-md hover:bg-green-100"
                  >
                    Republicar
                  </button>
                )}
                <button
                  onClick={() => handleStatusChange(product.id!, "deleted")}
                  className="flex-1 md:flex-none text-center px-3 py-2 text-sm font-medium text-red-600 bg-red-50 rounded-md hover:bg-red-100"
                >
                  Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
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

        const entries: ContactedProduct[] = await Promise.all(
          Array.from(grouped.entries()).map(async ([productId, info]) => {
            try {
              const productSnap = await getDoc(doc(db, "products", productId));
              if (!productSnap.exists()) {
                return { productId, ...info, product: null };
              }
              const data = productSnap.data();
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

        entries.sort((a, b) => b.lastAt.getTime() - a.lastAt.getTime());
        setContacted(entries);
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

        ordersData.sort((a, b) => {
          const dateA = toDate(a.createdAt) ?? new Date();
          const dateB = toDate(b.createdAt) ?? new Date();
          return dateB.getTime() - dateA.getTime();
        });
        setOrders(ordersData);

        const sellerIds = Array.from(new Set(ordersData.map((o) => o.sellerId)));
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
      alert("El vendedor no ha configurado su numero de WhatsApp.");
      return;
    }

    try {
      await logContactClick(order.productId, userId, order.sellerId, "whatsapp");
    } catch (error) {
      console.error("Error registrando clic de contacto:", error);
    }

    const normalizedPhone = phone.replace(/[^\d]/g, "");
    const message = encodeURIComponent(
      `Hola, vi tu producto "${order.productTitle}" en Truequéalope. ¿Sigue disponible?`
    );
    const waUrl = `https://wa.me/${normalizedPhone}?text=${message}`;
    window.open(waUrl, "_blank");
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <section className="bg-white rounded-lg shadow-sm border">
        <div className="px-5 py-4 border-b">
          <h2 className="text-lg font-bold text-gray-900">Contactados</h2>
          <p className="text-sm text-gray-500">
            Productos donde hiciste clic en contactar.
          </p>
        </div>

        {loadingContacted ? (
          <div className="p-6 text-center text-gray-600">Cargando...</div>
        ) : contacted.length === 0 ? (
          <div className="p-6 text-center text-gray-600">
            Aun no has contactado productos.
            <div className="mt-4">
              <Link href="/search">
                <Button variant="outline">Explorar productos</Button>
              </Link>
            </div>
          </div>
        ) : (
          <ul className="divide-y">
            {contacted.map((item) => {
              const product = item.product;
              const categoryName = product
                ? CATEGORIES.find((c) => c.id === product.categoryId)?.name ??
                  "Otro"
                : null;

              return (
                <li key={item.productId} className="p-4">
                  <div className="flex gap-4">
                    <div className="relative h-16 w-16 flex-shrink-0 rounded-md overflow-hidden bg-gray-100">
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
                          <p className="font-semibold text-gray-900 truncate">
                            {product?.title ?? "Producto no disponible"}
                          </p>
                          <p className="text-xs text-gray-500">
                            {categoryName ? `${categoryName} · ` : ""}
                            Ultimo: {item.lastAt.toLocaleDateString()}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-gray-500">Clics</p>
                          <p className="font-bold text-gray-900">{item.count}</p>
                        </div>
                      </div>

                      <div className="mt-3 flex gap-2">
                        <Link href={`/products/${item.productId}`}>
                          <Button size="sm" variant="outline">
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

      <section className="bg-white rounded-lg shadow-sm border">
        <div className="px-5 py-4 border-b">
          <h2 className="text-lg font-bold text-gray-900">Mis compras</h2>
          <p className="text-sm text-gray-500">Historial de compras.</p>
        </div>

        {loadingOrders ? (
          <div className="p-6 text-center text-gray-600">Cargando...</div>
        ) : orders.length === 0 ? (
          <div className="p-6 text-center text-gray-600">
            No has realizado compras aun.
            <div className="mt-4">
              <Link href="/search">
                <Button variant="outline">Explorar productos</Button>
              </Link>
            </div>
          </div>
        ) : (
          <ul className="divide-y">
            {orders.map((order) => (
              <li key={order.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 truncate">
                      {order.productTitle}
                    </p>
                    <p className="text-xs text-gray-500">
                      {toDate(order.createdAt)?.toLocaleDateString() ?? ""}
                    </p>
                    <p className="mt-1 text-sm font-bold text-gray-900">
                      S/. {order.price.toLocaleString()}
                    </p>
                  </div>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 capitalize">
                    {order.status === "completed" ? "Completado" : order.status}
                  </span>
                </div>
                <div className="mt-3 flex gap-2 flex-wrap">
                  <button
                    onClick={() => handleContactSeller(order)}
                    className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                  >
                    Contactar vendedor
                  </button>
                  <Link href={`/products/${order.productId}`}>
                    <Button size="sm" variant="outline">
                      Ver producto
                    </Button>
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function ActivityContent() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const tabFromQuery = useMemo<ActivityTab>(() => {
    const t = searchParams.get("tab");
    return t === "buyer" ? "buyer" : "seller";
  }, [searchParams]);

  const [tab, setTab] = useState<ActivityTab>(tabFromQuery);

  useEffect(() => {
    setTab(tabFromQuery);
  }, [tabFromQuery]);

  const setTabAndUrl = (nextTab: ActivityTab) => {
    setTab(nextTab);
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", nextTab);
    router.replace(`/activity?${params.toString()}`);
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-50 py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Actividad</h1>
            <p className="mt-1 text-sm text-gray-500">
              Vistas, contactos y compras en un solo lugar.
            </p>
          </div>
          <Link href="/products/new" className="w-fit">
            <Button>+ Publicar</Button>
          </Link>
        </div>

        <div className="border-b border-gray-200 mb-6">
          <nav className="-mb-px flex gap-6" aria-label="Tabs">
            <button
              type="button"
              onClick={() => setTabAndUrl("seller")}
              className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
                tab === "seller"
                  ? "border-indigo-600 text-indigo-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              Como vendedor
            </button>
            <button
              type="button"
              onClick={() => setTabAndUrl("buyer")}
              className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
                tab === "buyer"
                  ? "border-indigo-600 text-indigo-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
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
  return (
    <Suspense fallback={<div className="p-8 text-center">Cargando...</div>}>
      <ActivityContent />
    </Suspense>
  );
}
