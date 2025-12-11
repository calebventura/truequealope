"use client";

import { useEffect, useState } from "react";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebaseClient";
import { useAuth } from "@/hooks/useAuth";
import { Order } from "@/types/order";
import Link from "next/link";
import Image from "next/image";
import { logContactClick } from "@/lib/contact";

export default function MyPurchasesPage() {
  const { user, loading: authLoading } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [sellerContacts, setSellerContacts] = useState<
    Record<string, { phoneNumber?: string | null; name?: string | null }>
  >({});

  useEffect(() => {
    const fetchOrders = async () => {
      if (!user) return;

      try {
        const q = query(
          collection(db, "orders"),
          where("buyerId", "==", user.uid)
        );

        const querySnapshot = await getDocs(q);
        const ordersData = querySnapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
          };
        }) as Order[];

        // Ordenar por fecha descendente en cliente
        ordersData.sort((a, b) => {
          const dateA = a.createdAt instanceof Date ? a.createdAt : new Date();
          const dateB = b.createdAt instanceof Date ? b.createdAt : new Date();
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
      } finally {
        setLoading(false);
      }
    };

    if (!authLoading && user) {
      fetchOrders();
    }
  }, [user, authLoading]);

  const handleContactSeller = async (order: Order) => {
    if (!user) return;

    const sellerContact = sellerContacts[order.sellerId];
    const phone = sellerContact?.phoneNumber;

    if (!phone) {
      alert("El vendedor no ha configurado su número de WhatsApp.");
      return;
    }

    try {
      await logContactClick(order.productId, user.uid, "whatsapp");
    } catch (error) {
      console.error("Error registrando clic de contacto:", error);
      // Continuamos para no bloquear la apertura de WhatsApp
    }

    const normalizedPhone = phone.replace(/[^\d]/g, "");
    const message = encodeURIComponent(
      `Hola, vi tu producto "${order.productTitle}" en Reutilizalope. ¿Sigue disponible?`
    );
    const waUrl = `https://wa.me/${normalizedPhone}?text=${message}`;
    window.open(waUrl, "_blank");
  };

  if (authLoading) return <div className="p-8 text-center">Cargando...</div>;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Mis Compras</h1>

        {loading ? (
          <div className="text-center py-10">Cargando tus compras...</div>
        ) : orders.length === 0 ? (
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
                d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
              />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">
              No has realizado compras aún
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              Explora el catálogo y encuentra algo genial.
            </p>
            <div className="mt-6">
              <Link
                href="/search"
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Explorar Productos
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <div
                key={order.id}
                className="bg-white shadow rounded-lg overflow-hidden flex flex-col sm:flex-row"
              >
                {/* Imagen del producto */}
                <div className="relative h-48 sm:h-auto sm:w-48 bg-gray-200">
                  {order.productImage ? (
                    <Image
                      src={order.productImage}
                      alt={order.productTitle}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full text-gray-400">
                      Sin imagen
                    </div>
                  )}
                </div>

                {/* Detalles de la orden */}
                <div className="p-6 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start">
                      <h3 className="text-lg font-bold text-gray-900">
                        <Link
                          href={`/products/${order.productId}`}
                          className="hover:underline hover:text-blue-600"
                        >
                          {order.productTitle}
                        </Link>
                      </h3>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 capitalize">
                        {order.status === "completed" ? "Completado" : order.status}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-gray-500">
                      Comprado el{" "}
                      {(order.createdAt as Date).toLocaleDateString()}
                    </p>
                    <p className="mt-2 text-xl font-bold text-gray-900">
                      ${order.price.toLocaleString()}
                    </p>
                  </div>

                  <div className="mt-4 flex gap-3">
                    <button
                      onClick={() => handleContactSeller(order)}
                      className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      Contactar Vendedor
                    </button>
                    <Link
                      href={`/products/${order.productId}`}
                      className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      Ver Producto
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
