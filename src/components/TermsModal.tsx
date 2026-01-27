"use client";

import { useEffect, useState } from "react";
import { TERMS_URL } from "@/lib/constants";
import { Button } from "@/components/ui/Button";

type TermsModalProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
};

export function TermsModal({ open, onClose, title = "Términos y Condiciones" }: TermsModalProps) {
  const [content, setContent] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const fetchTerms = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(TERMS_URL);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const text = await res.text();
        if (!cancelled) setContent(text);
      } catch (err) {
        if (!cancelled) setError("No se pudieron cargar los términos. Intenta de nuevo.");
        console.error("Error fetching terms:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchTerms();
    return () => {
      cancelled = true;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-3xl rounded-xl bg-white dark:bg-gray-900 shadow-xl border border-gray-200 dark:border-gray-800 p-6 flex flex-col gap-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h3>
          <button
            onClick={onClose}
            className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>
        <div className="border rounded-lg border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950/60 p-4 max-h-[65vh] overflow-y-auto whitespace-pre-wrap text-sm text-gray-800 dark:text-gray-100">
          {loading ? "Cargando..." : error ? error : content || "Sin contenido."}
        </div>
        <div className="flex justify-end">
          <Button onClick={onClose}>Cerrar</Button>
        </div>
      </div>
    </div>
  );
}
