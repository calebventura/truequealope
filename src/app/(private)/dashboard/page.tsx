"use client";

import { useEffect, useState } from "react";
import { signOut } from "firebase/auth";
import { auth, db } from "@/lib/firebaseClient";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { collection, query, where, getDocs, doc, updateDoc, orderBy } from "firebase/firestore";
import { Product } from "@/types/product";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/Button";

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);

  useEffect(() => {
    const fetchMyProducts = async () => {
      if (!user) return;
      try {
        const q = query(
          collection(db, "products"),
          where("sellerId", "==", user.uid),
          where("status", "!=", "deleted") // No mostrar eliminados
        );
        
        const querySnapshot = await getDocs(q);
        const productsData = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate ? doc.data().createdAt.toDate() : new Date()
        })) as Product[];

        // Ordenar por fecha (más reciente primero) ya que Firestore tiene limitaciones con '!=' y 'orderBy' juntos en ciertos casos sin índice
        productsData.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

        setProducts(productsData);
      } catch (error) {
        console.error("Error fetching products:", error);
      } finally {
        setLoadingProducts(false);
      }
    };

    if (!authLoading && user) {
      fetchMyProducts();
    }
  }, [user, authLoading]);

  const handleStatusChange = async (productId: string, newStatus: "active" | "reserved" | "sold" | "deleted") => {
    if (!confirm(`¿Estás seguro de cambiar el estado a ${newStatus === 'deleted' ? 'ELIMINADO' : newStatus}?`)) return;

    try {
      const productRef = doc(db, "products", productId);
      await updateDoc(productRef, { status: newStatus });

      if (newStatus === "deleted") {
        setProducts(products.filter(p => p.id !== productId));
      } else {
        setProducts(products.map(p => p.id === productId ? { ...p, status: newStatus } : p));
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
      console.error("Error al cerrar sesión:", error);
    }
  };

  if (authLoading) return <div className="p-8 text-center">Cargando...</div>;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Mi Dashboard</h1>
            <p className="mt-1 text-sm text-gray-500">Gestiona tus publicaciones y ventas.</p>
          </div>
          <div className="flex gap-4">
            <Link href="/products/new">
              <Button>+ Nueva Publicación</Button>
            </Link>
            <Button variant="outline" onClick={handleLogout} className="text-red-600 border-red-200 hover:bg-red-50">
              Cerrar Sesión
            </Button>
          </div>
        </div>

        {/* Stats Cards (Placeholder for future) */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3 mb-8">
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <dt className="text-sm font-medium text-gray-500 truncate">Total Publicaciones</dt>
              <dd className="mt-1 text-3xl font-semibold text-gray-900">{products.length}</dd>
            </div>
          </div>
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <dt className="text-sm font-medium text-gray-500 truncate">Ventas Realizadas</dt>
              <dd className="mt-1 text-3xl font-semibold text-gray-900">
                {products.filter(p => p.status === 'sold').length}
              </dd>
            </div>
          </div>
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <dt className="text-sm font-medium text-gray-500 truncate">En Negociación</dt>
              <dd className="mt-1 text-3xl font-semibold text-gray-900">
                {products.filter(p => p.status === 'reserved').length}
              </dd>
            </div>
          </div>
        </div>

        <h2 className="text-xl font-bold text-gray-900 mb-4">Mis Publicaciones</h2>
        
        {loadingProducts ? (
          <div className="text-center py-10">Cargando tus productos...</div>
        ) : products.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg shadow">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No tienes publicaciones</h3>
            <p className="mt-1 text-sm text-gray-500">Empieza a vender tus productos hoy mismo.</p>
            <div className="mt-6">
              <Link href="/products/new">
                <Button>Crear primera publicación</Button>
              </Link>
            </div>
          </div>
        ) : (
          <div className="bg-white shadow overflow-hidden sm:rounded-md">
            <ul className="divide-y divide-gray-200">
              {products.map((product) => (
                <li key={product.id}>
                  <div className="px-4 py-4 sm:px-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center flex-1 min-w-0">
                        <div className="flex-shrink-0 h-16 w-16 relative rounded-md overflow-hidden border border-gray-200">
                          {product.images && product.images[0] ? (
                            <Image 
                              src={product.images[0]} 
                              alt={product.title} 
                              fill 
                              className="object-cover"
                            />
                          ) : (
                            <div className="h-full w-full bg-gray-100 flex items-center justify-center text-xs text-gray-400">Sin foto</div>
                          )}
                        </div>
                        <div className="ml-4 flex-1">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium text-blue-600 truncate">
                              <Link href={`/products/${product.id}`} className="hover:underline">
                                {product.title}
                              </Link>
                            </p>
                            <div className="ml-2 flex-shrink-0 flex">
                              <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                                ${product.status === 'active' ? 'bg-green-100 text-green-800' : 
                                  product.status === 'reserved' ? 'bg-yellow-100 text-yellow-800' : 
                                  'bg-gray-100 text-gray-800'}`}>
                                {product.status === 'active' ? 'Activo' : 
                                 product.status === 'reserved' ? 'Reservado' : 'Vendido'}
                              </span>
                            </div>
                          </div>
                          <div className="mt-2 flex justify-between items-center">
                            <div className="sm:flex">
                              <p className="flex items-center text-sm text-gray-500">
                                ${product.price.toLocaleString()}
                              </p>
                              <p className="mt-2 flex items-center text-sm text-gray-500 sm:mt-0 sm:ml-6">
                                {product.createdAt.toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 flex justify-end space-x-3 border-t pt-4">
                      {product.status !== 'sold' && (
                        <>
                          {product.status === 'active' ? (
                            <button
                              onClick={() => handleStatusChange(product.id!, 'reserved')}
                              className="text-sm text-yellow-600 hover:text-yellow-900 font-medium"
                            >
                              Marcar Reservado
                            </button>
                          ) : (
                            <button
                              onClick={() => handleStatusChange(product.id!, 'active')}
                              className="text-sm text-green-600 hover:text-green-900 font-medium"
                            >
                              Marcar Disponible
                            </button>
                          )}
                          <button
                            onClick={() => handleStatusChange(product.id!, 'sold')}
                            className="text-sm text-blue-600 hover:text-blue-900 font-medium"
                          >
                            Marcar Vendido
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => handleStatusChange(product.id!, 'deleted')}
                        className="text-sm text-red-600 hover:text-red-900 font-medium"
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
