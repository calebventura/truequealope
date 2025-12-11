"use client";

import { useEffect, useState } from "react";
import { signOut } from "firebase/auth";
import { auth, db } from "@/lib/firebaseClient";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { collection, doc, getDocs, query, updateDoc, where } from "firebase/firestore";
import { Product } from "@/types/product";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { getContactClicksCount } from "@/lib/contact";

type TabKey = "active" | "history";
type ProductStatus = "active" | "reserved" | "sold" | "deleted";

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>("active");
  const [contactCounts, setContactCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    const fetchMyProducts = async () => {
      if (!user) return;
      try {
        const q = query(
          collection(db, "products"),
          where("sellerId", "==", user.uid)
        );

        const snapshot = await getDocs(q);
        const productsData = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
          createdAt: docSnap.data().createdAt?.toDate
            ? docSnap.data().createdAt.toDate()
            : new Date(),
        })) as Product[];

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

    if (!authLoading && user) {
      fetchMyProducts();
    }
  }, [authLoading, user]);

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
          prev.map((p) =>
            p.id === productId ? { ...p, status: newStatus } : p
          )
        );
      }
    } catch (error) {
      console.error("Error updating status:", error);
      alert("Error al actualizar el estado");
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push("/auth/login");
    } catch (error) {
      console.error("Error al cerrar sesion:", error);
    }
  };

  const displayedProducts = products.filter((p) =>
    activeTab === "active"
      ? p.status === "active" || p.status === "reserved"
      : p.status === "sold"
  );

  if (authLoading) return <div className="p-8 text-center">Cargando...</div>;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Mi Dashboard</h1>
            <p className="mt-1 text-sm text-gray-500">
              Gestiona tus publicaciones y ventas.
            </p>
          </div>
          <div className="flex gap-4">
            <Link href="/products/new">
              <Button>+ Nueva Publicacion</Button>
            </Link>
            <Button
              variant="outline"
              onClick={handleLogout}
              className="text-red-600 border-red-200 hover:bg-red-50"
            >
              Cerrar Sesion
            </Button>
          </div>
        </div>

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
                      {new Intl.NumberFormat("es-CL", {
                        style: "currency",
                        currency: "CLP",
                      }).format(product.price)}
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
                      {product.status === "active" ? (
                        <button
                          onClick={() =>
                            handleStatusChange(product.id!, "reserved")
                          }
                          className="flex-1 md:flex-none text-center px-3 py-2 text-sm font-medium text-yellow-600 bg-yellow-50 rounded-md hover:bg-yellow-100"
                        >
                          Reservar
                        </button>
                      ) : (
                        <button
                          onClick={() =>
                            handleStatusChange(product.id!, "active")
                          }
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
    </div>
  );
}
