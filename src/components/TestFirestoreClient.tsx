"use client";

import { useState } from "react";
import { db } from "@/lib/firebaseClient";
import { collection, addDoc, getDocs, query, limit } from "firebase/firestore";
import { Button } from "@/components/ui/Button";

export default function TestFirestoreClient() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");

  const handleWrite = async () => {
    setLoading(true);
    setStatus("Escribiendo...");
    try {
      const docRef = await addDoc(collection(db, "test"), {
        message: "Hello Firebase from Next.js!",
        timestamp: new Date(),
        userAgent: navigator.userAgent,
      });
      setStatus(`Documento escrito con ID: ${docRef.id}`);
    } catch (e) {
      console.error("Error adding document: ", e);
      setStatus("Error al escribir documento. Revisa la consola (F12).");
    }
    setLoading(false);
  };

  const handleRead = async () => {
    setLoading(true);
    setStatus("Leyendo...");
    try {
      const q = query(collection(db, "test"), limit(5));
      const querySnapshot = await getDocs(q);
      const docs = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setData(docs);
      setStatus(`Leídos ${docs.length} documentos.`);
    } catch (e) {
      console.error("Error reading documents: ", e);
      setStatus("Error al leer documentos. Revisa la consola (F12).");
    }
    setLoading(false);
  };

  return (
    <div className="p-6 border rounded-lg shadow-sm space-y-4 bg-white max-w-md mx-auto mt-8">
      <h2 className="text-xl font-bold text-gray-800">Test Firestore Client</h2>
      <p className="text-sm text-gray-500">
        Prueba de conexión a la colección 'test'.
      </p>

      <div className="flex gap-3">
        <Button onClick={handleWrite} disabled={loading}>
          Escribir Dato
        </Button>
        <Button onClick={handleRead} variant="secondary" disabled={loading}>
          Leer Datos
        </Button>
      </div>

      {status && (
        <div
          className={`p-2 rounded text-sm ${status.includes("Error") ? "bg-red-50 text-red-600" : "bg-green-50 text-green-600"}`}
        >
          {status}
        </div>
      )}

      <div className="bg-gray-900 text-gray-100 p-3 rounded text-xs font-mono overflow-auto max-h-60">
        {data.length > 0 ? (
          <pre>{JSON.stringify(data, null, 2)}</pre>
        ) : (
          <span className="text-gray-500">// Los datos aparecerán aquí...</span>
        )}
      </div>
    </div>
  );
}
