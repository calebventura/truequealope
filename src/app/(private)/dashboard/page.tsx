"use client";

import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebaseClient";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";

export default function DashboardPage() {
  const { user } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push("/auth/login");
    } catch (error) {
      console.error("Error al cerrar sesión:", error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-800">
            Dashboard Privado
          </h1>
          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
          >
            Cerrar Sesión
          </button>
        </div>

        <div className="space-y-4">
          <div className="p-4 bg-blue-50 border border-blue-200 rounded">
            <p className="text-blue-800">
              <strong>Estado:</strong> Autenticado
            </p>
            <p className="text-blue-800">
              <strong>Email:</strong> {user?.email}
            </p>
            <p className="text-blue-800">
              <strong>UID:</strong> {user?.uid}
            </p>
          </div>

          <p className="text-gray-600">
            Esta página está protegida. Solo puedes verla si has iniciado
            sesión. Si intentas acceder directamente sin estar logueado, serás
            redirigido al login.
          </p>
        </div>
      </div>
    </div>
  );
}
