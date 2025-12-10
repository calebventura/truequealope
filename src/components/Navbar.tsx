'use client';

import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/hooks/useAuth";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebaseClient";
import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";

export const Navbar = () => {
  const { user, loading } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push("/");
    } catch (error) {
      console.error("Error al cerrar sesión:", error);
    }
  };

  return (
    <nav className="border-b border-gray-200 bg-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 justify-between items-center">
          {/* Logo */}
          <div className="flex items-center">
            <Link href="/" className="flex items-center">
              <span className="text-2xl font-bold text-blue-600">
                Reutilizalope
              </span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-8">
            <Link
              href="/buscar"
              className="text-gray-600 hover:text-blue-600 transition-colors"
            >
              Explorar
            </Link>
            <Link
              href="/categorias"
              className="text-gray-600 hover:text-blue-600 transition-colors"
            >
              Categorías
            </Link>
          </div>

          {/* Actions */}
          <div className="flex items-center space-x-4">
            <Link href="/products/new">
              <Button variant="outline" size="sm">
                + Vender
              </Button>
            </Link>

            {loading ? (
              <div className="h-8 w-8 animate-pulse rounded-full bg-gray-200" />
            ) : user ? (
              <div className="relative">
                <button
                  onClick={() => setIsMenuOpen(!isMenuOpen)}
                  className="flex items-center space-x-2 focus:outline-none"
                >
                  {user.photoURL ? (
                    <Image
                      src={user.photoURL}
                      alt="Perfil"
                      width={32}
                      height={32}
                      className="rounded-full object-cover border border-gray-200"
                    />
                  ) : (
                    <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">
                      {user.displayName ? user.displayName[0].toUpperCase() : user.email?.[0].toUpperCase()}
                    </div>
                  )}
                  <span className="hidden md:block text-sm font-medium text-gray-700">
                    {user.displayName || user.email}
                  </span>
                </button>

                {/* Dropdown Menu */}
                {isMenuOpen && (
                  <div className="absolute right-0 mt-2 w-48 origin-top-right rounded-md bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5 z-50">
                    <div className="px-4 py-2 border-b border-gray-100">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {user.displayName || "Usuario"}
                      </p>
                      <p className="text-xs text-gray-500 truncate">{user.email}</p>
                    </div>
                    <Link
                      href="/profile"
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      Mi Perfil
                    </Link>
                    <Link
                      href="/mis-compras"
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      Mis Compras
                    </Link>
                    <button
                      onClick={() => {
                        setIsMenuOpen(false);
                        handleLogout();
                      }}
                      className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100"
                    >
                      Cerrar Sesión
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link href="/auth/login">
                <Button variant="primary" size="sm">
                  Ingresar
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};
