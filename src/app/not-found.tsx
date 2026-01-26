import React from "react";

export const dynamic = "force-static";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-950 text-center px-6">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Página no encontrada</h1>
      <p className="mt-3 text-gray-600 dark:text-gray-400">
        No pudimos encontrar la página que buscas.
      </p>
      <a
        href="/"
        className="mt-6 inline-flex items-center px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700"
      >
        Volver al inicio
      </a>
    </div>
  );
}
