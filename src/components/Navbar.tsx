import Link from "next/link";
import { Button } from "@/components/ui/Button";

export const Navbar = () => {
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
            <Link href="/vender">
              <Button variant="outline" size="sm">
                + Vender
              </Button>
            </Link>
            <Link href="/auth/login">
              <Button variant="primary" size="sm">
                Ingresar
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
};
