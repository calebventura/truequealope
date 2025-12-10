'use client';

import { useEffect, useState } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebaseClient';
import { Product } from '@/types/product';
import { CATEGORIES } from '@/lib/constants';
import Link from 'next/link';
import Image from 'next/image';

export default function HomePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        // Crear query para productos activos y reservados
        const q = query(
          collection(db, 'products'),
          where('status', 'in', ['active', 'reserved'])
        );

        const querySnapshot = await getDocs(q);
        const productsData = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          // Convertir Timestamp a Date si es necesario
          createdAt: doc.data().createdAt?.toDate ? doc.data().createdAt.toDate() : new Date()
        })) as Product[];

        setProducts(productsData);
      } catch (error) {
        console.error("Error fetching products:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, []);

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
        
        {/* Categorías */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Categorías</h2>
          <div className="flex overflow-x-auto pb-4 gap-4 scrollbar-hide snap-x snap-mandatory">
            {CATEGORIES.map((category) => (
              <Link
                key={category.id}
                href={`/search?category=${category.id}`}
                className="flex-shrink-0 w-32 h-32 bg-white rounded-xl shadow-sm flex flex-col items-center justify-center gap-3 hover:shadow-md transition-shadow border border-gray-100 snap-start"
              >
                <span className="text-3xl">{category.icon}</span>
                <span className="font-medium text-gray-900 text-sm text-center px-2">{category.name}</span>
              </Link>
            ))}
          </div>
        </div>

        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Productos Recientes</h1>
          <Link 
            href="/products/new" 
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
          >
            Vender algo
          </Link>
        </div>

        {products.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">No hay productos activos en este momento.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
            {products.map((product) => (
              <Link key={product.id} href={`/products/${product.id}`} className="group">
                <div className="bg-white rounded-xl shadow-sm overflow-hidden hover:shadow-md transition-shadow duration-200 h-full flex flex-col">
                  <div className="relative aspect-square w-full bg-gray-200">
                    {product.status === 'reserved' && (
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
                    <h3 className="text-lg font-semibold text-gray-900 line-clamp-1">{product.title}</h3>
                    <p className="text-xl font-bold text-gray-900 mt-1">
                      ${product.price.toLocaleString()}
                    </p>
                    <div className="mt-auto pt-4 flex items-center justify-between text-sm text-gray-500">
                      <span className="flex items-center">
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        {product.location}
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
