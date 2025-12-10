'use client';

import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebaseClient';
import { Product } from '@/types/product';
import { createOrGetChat } from '@/lib/chat';
import { useAuth } from '@/hooks/useAuth';
import { useRouter, useParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';

export default function ProductDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState<string>('');
  const { user } = useAuth();
  const router = useRouter();
  const [contacting, setContacting] = useState(false);

  const handleContact = async () => {
    if (!user) {
      router.push('/login');
      return;
    }
    if (!product) return;

    setContacting(true);
    try {
      const chatId = await createOrGetChat(user.uid, product.sellerId, product.id!);
      router.push(`/chat/${chatId}`);
    } catch (error) {
      console.error("Error al contactar:", error);
      alert("No se pudo iniciar el chat. Inténtalo de nuevo.");
    } finally {
      setContacting(false);
    }
  };

  useEffect(() => {
    const fetchProduct = async () => {
      if (!id) return;
      try {
        const docRef = doc(db, 'products', id);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data();
          const productData = {
            id: docSnap.id,
            ...data,
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date()
          } as Product;
          
          setProduct(productData);
          if (productData.images && productData.images.length > 0) {
            setSelectedImage(productData.images[0]);
          }
        } else {
          console.log("No such document!");
        }
      } catch (error) {
        console.error("Error fetching product:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [id]);

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
        <h1 className="text-2xl font-bold text-gray-800 mb-4">Producto no encontrado</h1>
        <Link href="/" className="text-blue-600 hover:underline">Volver al inicio</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <Link href="/" className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-6">
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Volver al listado
        </Link>

        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
            {/* Galería de Imágenes */}
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
                  <div className="flex items-center justify-center h-full text-gray-400">Sin imagen</div>
                )}
              </div>
              
              {product.images && product.images.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {product.images.map((img, index) => (
                    <button
                      key={index}
                      onClick={() => setSelectedImage(img)}
                      className={`relative w-20 h-20 flex-shrink-0 rounded-md overflow-hidden border-2 ${
                        selectedImage === img ? 'border-blue-600' : 'border-transparent'
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

            {/* Detalles del Producto */}
            <div className="p-8 flex flex-col">
              <div className="mb-auto">
                <div className="flex justify-between items-start">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 capitalize">
                    {product.condition === 'like-new' ? 'Como nuevo' : product.condition === 'new' ? 'Nuevo' : 'Usado'}
                  </span>
                  <span className="text-sm text-gray-500">
                    {product.createdAt.toLocaleDateString()}
                  </span>
                </div>

                <h1 className="mt-4 text-3xl font-bold text-gray-900">{product.title}</h1>
                <p className="mt-2 text-4xl font-bold text-gray-900">
                  ${product.price.toLocaleString()}
                </p>

                <div className="mt-6 flex items-center text-gray-600">
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  {product.location}
                </div>

                <div className="mt-8">
                  <h3 className="text-sm font-medium text-gray-900">Descripción</h3>
                  <div className="mt-2 prose prose-sm text-gray-500">
                    <p className="whitespace-pre-line">{product.description}</p>
                  </div>
                </div>
              </div>

              <div className="mt-8 pt-8 border-t border-gray-200">
                {user?.uid !== product.sellerId ? (
                  <button 
                    onClick={handleContact}
                    disabled={contacting}
                    className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    {contacting ? 'Iniciando chat...' : 'Contactar al Vendedor'}
                  </button>
                ) : (
                  <div className="w-full bg-gray-100 text-gray-500 py-3 px-4 rounded-lg font-semibold text-center">
                    Esta es tu publicación
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
